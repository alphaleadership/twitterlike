/**
 * Client SSE (Server-Sent Events) pour Twitterlike
 * Permet l'affichage en direct de l'état de la base de données, du mode CDN,
 * des interactions, et la réception de tweets en streaming direct sans blocage initial.
 */

(function () {
  'use strict';

  if (!('EventSource' in window)) {
    console.warn('[SSE] EventSource non supporté par ce navigateur.');
    return;
  }

  let eventSource = null;
  let activeStreamSource = null;
  let statusBanner = null;
  const pendingNewTweets = [];

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    });
  }

  function createStatusBanner() {
    if (statusBanner) return statusBanner;
    statusBanner = document.createElement('div');
    statusBanner.id = 'sse-live-banner';
    statusBanner.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 99999;
      background: rgba(21, 32, 43, 0.95);
      color: #fff;
      padding: 10px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      border: 1px solid #38444d;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      pointer-events: auto;
    `;
    document.body.appendChild(statusBanner);
    return statusBanner;
  }

  function updateStatus(dotColor, text, autoHide = false) {
    const banner = createStatusBanner();
    banner.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${dotColor}; box-shadow:0 0 6px ${dotColor};"></span>
      <span>${text}</span>
    `;
    banner.style.opacity = '1';
    banner.style.transform = 'translateY(0)';

    if (autoHide) {
      setTimeout(() => {
        if (banner) {
          banner.style.opacity = '0';
          banner.style.transform = 'translateY(10px)';
        }
      }, 3500);
    }
  }

  function createTweetCardElement(tweet) {
    const card = document.createElement('div');
    card.className = 'tweet-card';
    card.setAttribute('data-tweet-id', tweet.id);
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    const container = document.getElementById('tweet-list-container');
    const isLoggedIn = container ? container.getAttribute('data-logged-in') === 'true' : false;

    let retweetHtml = '';
    if (tweet.isRetweet && tweet.retweetedBy) {
      retweetHtml = `
        <div class="retweet-info">
          <p>🔁 Retweeted by <a href="/profile/${escapeHtml(tweet.retweetedBy)}">@${escapeHtml(tweet.retweetedBy)}</a></p>
        </div>
      `;
    }

    const formattedDate = tweet.formattedDate || (tweet.date && !isNaN(new Date(tweet.date).getTime()) ? new Date(tweet.date).toLocaleDateString() : '');
    const compteEscaped = escapeHtml(tweet.compte || '');
    const tweetTextHtml = tweet.formattedText || escapeHtml(tweet.texte || '');

    let quoteHtml = '';
    if (tweet.formattedQuote) {
      quoteHtml = `<div class="tweet-quote"><p>${tweet.formattedQuote}</p></div>`;
    }

    let mediaHtml = '';
    if (tweet.allMedia && tweet.allMedia.length > 0) {
      mediaHtml = '<div class="tweet-media">';
      tweet.allMedia.forEach(m => {
        if (m.type === 'photo') {
          const src = m.locallien || m.lien;
          mediaHtml += `<img src="${escapeHtml(src)}" loading="lazy" decoding="async" alt="Tweet Media">`;
        } else if (m.type === 'video') {
          mediaHtml += `<video controls src="${escapeHtml(m.lien)}"></video>`;
        }
      });
      mediaHtml += '</div>';
    }

    let actionsHtml = '<div class="tweet-actions">';
    if (isLoggedIn) {
      actionsHtml += `
        <form action="${tweet.isLiked ? '/unlike/' : '/like/'}${encodeURIComponent(tweet.id)}" method="post" style="display: inline;">
          <button type="submit">${tweet.isLiked ? 'Unlike' : 'Like'}</button>
        </form>
      `;
    }
    actionsHtml += `
      <form action="/hide/${compteEscaped}" method="post" style="display: inline;">
        <button type="submit">Hide Account</button>
      </form>
    `;
    if (isLoggedIn) {
      actionsHtml += `
        <form action="${tweet.isAccountLiked ? '/unlike-account/' : '/like-account/'}${compteEscaped}" method="post" style="display: inline;">
          <button type="submit">${tweet.isAccountLiked ? 'Unlike Account' : 'Like Account'}</button>
        </form>
      `;
    }
    actionsHtml += `
      <a href="/tweet/${encodeURIComponent(tweet.id)}">View Tweet</a>
      <form action="/hide-tweet/${encodeURIComponent(tweet.id)}" method="post" style="display: inline;">
        <button type="submit">Hide Tweet</button>
      </form>
    </div>`;

    card.innerHTML = `
      ${retweetHtml}
      <div class="tweet-header">
        <img src="/public/images/profiles/${compteEscaped}.png" loading="lazy" decoding="async" alt="Profile Picture for ${compteEscaped}" class="profile-pic-tweet" onerror="this.onerror=null;this.src='/public/images/default_profile.png';">
        <p><strong><a href="/profile/${compteEscaped}">${compteEscaped}</a></strong> @${compteEscaped} - ${formattedDate}</p>
      </div>
      <p>${tweetTextHtml}</p>
      ${quoteHtml}
      ${mediaHtml}
      ${actionsHtml}
    `;

    return card;
  }

  function updatePagination(meta) {
    const pagination = document.querySelector('.pagination');
    if (!pagination || !meta) return;
    const currentPage = parseInt(meta.currentPage) || 1;
    const totalPages = parseInt(meta.totalPages) || 1;
    const searchQuery = meta.searchQuery || '';

    const currentUrl = new URL(window.location.href);
    const baseUrl = currentUrl.pathname;

    const prevParams = new URLSearchParams();
    if (searchQuery) prevParams.set('search', searchQuery);
    prevParams.set('page', currentPage - 1);

    const nextParams = new URLSearchParams();
    if (searchQuery) nextParams.set('search', searchQuery);
    nextParams.set('page', currentPage + 1);

    let html = '';
    if (currentPage > 1) {
      html += `<a href="${baseUrl}?${prevParams.toString()}">Previous</a> `;
    }
    html += `<span>Page ${currentPage} of ${totalPages}</span> `;
    if (currentPage < totalPages) {
      html += `<a href="${baseUrl}?${nextParams.toString()}">Next</a>`;
    }
    pagination.innerHTML = html;
  }

  /**
   * Streaming direct de tweets via SSE vers le conteneur du flux
   */
  function streamTweets(page = 1, searchQuery = '') {
    const container = document.getElementById('tweet-list-container');
    const btn = document.getElementById('btn-stream-sse');
    const icon = document.getElementById('sse-btn-icon');
    const text = document.getElementById('sse-btn-text');

    if (!container) return;

    if (activeStreamSource) {
      activeStreamSource.close();
      activeStreamSource = null;
    }

    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      if (icon) icon.textContent = '⏳';
      if (text) text.textContent = 'Streaming en cours...';
    }

    container.innerHTML = `
      <div id="sse-stream-indicator" style="padding: 24px; text-align: center; color: #8899a6; font-size: 14px; background: #192734; border-radius: 12px; margin-bottom: 16px; border: 1px dashed #38444d;">
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: 600; color: #1d9bf0;">⚡ Connexion au flux SSE des tweets...</div>
        <div id="sse-stream-counter">Réception des tweets en temps réel...</div>
      </div>
    `;

    const streamUrl = `/api/tweets/stream?page=${encodeURIComponent(page)}&query=${encodeURIComponent(searchQuery)}`;
    activeStreamSource = new EventSource(streamUrl);
    let tweetCount = 0;

    activeStreamSource.addEventListener('metadata', function (e) {
      try {
        const meta = JSON.parse(e.data);
        console.log('[SSE Tweet Stream] Métadonnées reçues :', meta);
        const counter = document.getElementById('sse-stream-counter');
        if (counter) {
          counter.textContent = `Page ${meta.currentPage} sur ${meta.totalPages} (${meta.totalTweets} tweets au total)`;
        }
        updatePagination(meta);
      } catch (_) {}
    });

    activeStreamSource.addEventListener('tweet', function (e) {
      try {
        const tweet = JSON.parse(e.data);
        tweetCount++;

        const card = createTweetCardElement(tweet);
        container.appendChild(card);

        // Animation d'apparition fluide
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });

        const counter = document.getElementById('sse-stream-counter');
        if (counter) {
          counter.textContent = `⚡ ${tweetCount} tweets reçus via SSE...`;
        }
      } catch (err) {
        console.error('[SSE Tweet Stream] Erreur parsing tweet :', err);
      }
    });

    activeStreamSource.addEventListener('end', function (e) {
      try {
        const endData = JSON.parse(e.data);
        console.log('[SSE Tweet Stream] Fin du flux reçue :', endData);
      } catch (_) {}

      const indicator = document.getElementById('sse-stream-indicator');
      if (indicator) {
        indicator.style.transition = 'all 0.4s ease';
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 400);
      }

      if (tweetCount === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.id = 'sse-empty-state';
        emptyNotice.style.cssText = 'padding: 36px; text-align: center; color: #8899a6; font-size: 15px;';
        emptyNotice.textContent = 'Aucun tweet trouvé.';
        container.appendChild(emptyNotice);
      }

      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (icon) icon.textContent = '⚡';
        if (text) text.textContent = 'Streaming SSE';
      }

      updateStatus('#00ba7c', `Flux SSE terminé (${tweetCount} tweets reçus)`, true);
      if (activeStreamSource) {
        activeStreamSource.close();
        activeStreamSource = null;
      }
    });

    activeStreamSource.addEventListener('error', function () {
      console.warn('[SSE Tweet Stream] Fin ou erreur de connexion au flux.');
      if (activeStreamSource) {
        activeStreamSource.close();
        activeStreamSource = null;
      }
      const indicator = document.getElementById('sse-stream-indicator');
      if (tweetCount === 0 && indicator) {
        indicator.innerHTML = '<div style="color: #f4212e;">Impossible de charger les tweets via SSE. Veuillez réessayer.</div>';
      } else if (indicator) {
        indicator.remove();
      }

      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (icon) icon.textContent = '⚡';
        if (text) text.textContent = 'Streaming SSE';
      }
    });
  }

  function initSSE() {
    const endpoint = '/api/events';
    eventSource = new EventSource(endpoint);

    eventSource.addEventListener('connected', function (e) {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Connecté au serveur temps réel :', data);
        if (data.cdnMode) {
          updateStatus('#f4212e', 'Mode CDN actif (Base de données hors-ligne)');
        } else {
          updateStatus('#00ba7c', 'En direct • Base connectée', true);
        }
      } catch (_) {}
    });

    eventSource.addEventListener('db-status', function (e) {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Statut MongoDB :', data.status);
        if (data.status === 'connected') {
          updateStatus('#00ba7c', 'MongoDB reconnecté • Mode direct', true);
          if (document.title.includes('Mode CDN')) {
            window.location.reload();
          }
        } else if (data.status === 'reconnecting') {
          updateStatus('#ffd400', 'Tentative de reconnexion MongoDB...');
        } else if (data.status === 'reconnect_failed' || data.status === 'disconnected') {
          updateStatus('#f4212e', 'Base de données inaccessible • Mode CDN actif');
        }
      } catch (_) {}
    });

    eventSource.addEventListener('cdn-mode', function (e) {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Mode CDN :', data.active);
        if (data.active) {
          updateStatus('#f4212e', 'Mode CDN automatique activé');
        } else {
          updateStatus('#00ba7c', 'Mode normal rétabli (MongoDB)', true);
          if (document.title.includes('Mode CDN')) {
            window.location.reload();
          }
        }
      } catch (_) {}
    });

    eventSource.addEventListener('new-tweet', function (e) {
      try {
        const tweet = JSON.parse(e.data);
        console.log('[SSE] Nouveau tweet reçu :', tweet);
        pendingNewTweets.unshift(tweet);

        const banner = document.getElementById('new-tweets-banner');
        const countSpan = document.getElementById('new-tweets-count');
        if (banner) {
          if (countSpan) countSpan.textContent = pendingNewTweets.length;
          banner.style.display = 'block';
        } else {
          updateStatus('#1d9bf0', `Nouveau tweet de @${escapeHtml(tweet.compte)}`, true);
        }
      } catch (_) {}
    });

    eventSource.addEventListener('tweet-interaction', function (e) {
      try {
        const data = JSON.parse(e.data);
        console.log('[SSE] Interaction tweet reçue :', data);
        if (data.type === 'hide_tweet' && data.tweetId) {
          const card = document.querySelector(`[data-tweet-id="${data.tweetId}"]`);
          if (card) {
            card.style.opacity = '0.3';
            card.style.pointerEvents = 'none';
          }
        }
      } catch (_) {}
    });

    eventSource.onerror = function () {
      console.warn('[SSE] Connexion interrompue, reconnexion automatique...');
    };

    // Gestion du bouton de streaming SSE manuel
    const btnStream = document.getElementById('btn-stream-sse');
    if (btnStream) {
      btnStream.addEventListener('click', function () {
        const page = this.getAttribute('data-page') || 1;
        const search = this.getAttribute('data-search') || '';
        streamTweets(page, search);
      });
    }

    // Gestion du bandeau des nouveaux tweets reçus
    const banner = document.getElementById('new-tweets-banner');
    if (banner) {
      banner.addEventListener('click', function () {
        const container = document.getElementById('tweet-list-container');
        if (container && pendingNewTweets.length > 0) {
          while (pendingNewTweets.length > 0) {
            const tweet = pendingNewTweets.pop();
            const card = createTweetCardElement(tweet);
            container.insertBefore(card, container.firstChild);
            requestAnimationFrame(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            });
          }
          banner.style.display = 'none';
        }
      });
    }

    // Chargement automatique des tweets en streaming SSE si configuré
    const container = document.getElementById('tweet-list-container');
    if (container && container.getAttribute('data-auto-stream') === 'true') {
      const page = parseInt(container.getAttribute('data-page')) || 1;
      const search = container.getAttribute('data-search') || '';
      console.log(`[SSE] Démarrage du streaming automatique (page: ${page}, search: "${search}")...`);
      streamTweets(page, search);
    }
  }

  // Exposer les méthodes de streaming publiquement
  window.TwitterLikeSSE = {
    streamTweets,
    updateStatus
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSSE);
  } else {
    initSSE();
  }
})();
