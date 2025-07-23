# API Endpoints

## Tweets
- `GET /api/tweets/page/:page` - Récupère les tweets paginés
  - Paramètres:
    - `:page` - Numéro de page (commence à 1)
  - Réponse:
    ```json
    {
      "tweets": [{
        "_id": "string",
        "contenu": "string",
        "compte": "string",
        "date": "ISO Date",
        "isFavorite": boolean,
        "isFavoriteAccount": boolean
      }],
      "currentPage": number,
      "totalPages": number,
      "totalTweets": number,
      "allAccounts": ["string"],
      "favoriteAccounts": ["string"]
    }
    ```

- `GET /api/search/:query` - Recherche des tweets
  - Paramètres:
    - `:query` - Terme de recherche
  - Réponse:
    ```json
    {
      "tweets": [{
        "_id": "string",
        "contenu": "string",
        "compte": "string",
        "date": "ISO Date",
        "isFavorite": boolean,
        "isFavoriteAccount": boolean
      }]
    }
    ```

## Profil
- `GET /api/profile/:username` - Tweets d'un utilisateur
- `GET /api/profile/:username/media` - Médias d'un utilisateur
- `GET /api/profile/:username/videos` - Vidéos d'un utilisateur

## Médias
- `GET /api/media/page/:page` - Tous les tweets avec médias
- `GET /api/videos/page/:page` - Tous les tweets avec vidéos

## Comptes
- `GET /api/accounts` - Liste des comptes
  - Réponse:
    ```json
    {
      "hidden": ["string"],
      "favorites": ["string"]
    }
    ```

- `POST /api/hide/:username` - Masquer un compte
- `POST /api/show/:username` - Afficher un compte
- `POST /api/favorite_account/:username` - Ajouter aux favoris
- `POST /api/unfavorite_account/:username` - Retirer des favoris

## Favoris
- `GET /api/favorites` - Liste des favoris
  - Réponse:
    ```json
    {
      "favorites": ["tweetId1", "tweetId2"]
    }
    ```

- `GET /api/favorite/:id` - Vérifier si un tweet est favori
  - Réponse:
    ```json
    {
      "isFavorite": boolean
    }
    ```

- `POST /api/favorite/:id` - Ajouter un favori
- `POST /api/unfavorite/:id` - Retirer un favori
