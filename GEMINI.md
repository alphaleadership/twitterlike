# Gemini Prompts for Express.js Development

## Database Operations

### MongoDB Connection
```
Create a secure MongoDB connection utility with connection pooling and error handling for an Express.js application. Include environment variable configuration and reconnection logic.
```

### Query Optimization
```
Optimize this MongoDB query for better performance: [paste your query]. The collection has indexes on [list relevant fields]. The query is slow when [describe the performance issue].
```

## API Development

### RESTful Endpoints
```
Create Express.js RESTful endpoints for a Twitter-like API with the following requirements:
- GET /api/tweets - Get paginated list of tweets
- POST /api/tweets - Create a new tweet
- GET /api/tweets/:id - Get a single tweet by ID
- PUT /api/tweets/:id - Update a tweet
- DELETE /api/tweets/:id - Delete a tweet
Include proper error handling, validation, and response formatting.
```

### Authentication Middleware
```
Implement JWT authentication middleware for Express.js that:
1. Verifies the token from the Authorization header
2. Handles token expiration
3. Attaches user data to the request object
4. Handles different user roles (admin, user, etc.)
```

## Error Handling

### Global Error Handler
```
Create a global error handling middleware for Express.js that:
1. Handles different types of errors (validation, database, authentication, etc.)
2. Logs errors appropriately
3. Returns user-friendly error messages in production
4. Includes stack traces in development
```



## Security

### Input Sanitization
```
Create middleware to sanitize user input in an Express.js application to prevent:
- XSS attacks
- NoSQL injection
- Other common web vulnerabilities
```





## Deployment

### PM2 Configuration
```
Create a PM2 ecosystem.config.js file for a production Express.js application that:
1. Uses cluster mode with number of workers equal to CPU cores
2. Handles graceful shutdown
3. Includes logging configuration
4. Manages environment variables
```

## Profile Page Enhancement

### Profile Page Improvements
```
Enhance the profile.ejs template with the following features:
1. User Statistics Section
   - Display total tweets, followers, following counts
   - Show account creation date
   - Add a progress bar for profile completion

2. Interactive Elements
   - Add a follow/unfollow button with AJAX functionality
   - Implement a message button that appears on hover
   - Add a dropdown menu for more actions (block, report, etc.)

3. Media Gallery
   - Create a tabbed interface for tweets, media, and likes
   - Implement a responsive grid layout for media
   - Add lightbox functionality for media previews

4. Responsive Design
   - Improve mobile layout for better touch targets
   - Add a collapsible sidebar for mobile view
   - Optimize images for different screen sizes
   - Ensure proper spacing and alignment across all devices
   - Test touch targets for accessibility (minimum 44x44px)

5. Performance Optimizations
   - Lazy load images and media
   - Implement infinite scroll for tweets
   - Add loading skeletons for better perceived performance
   - Optimize CSS and JavaScript bundle sizes
   - Implement proper caching strategies

```

## Utility Functions

### Request Validation
```
Implement request validation middleware using express-validator that:
1. Validates request body, params, and query
2. Returns detailed error messages
3. Handles custom validation logic
4. Supports conditional validation
```

## Important Note
- Never modify tweet.json directly
- Always validate and sanitize user input
- Implement proper error handling for all database operations
- Follow RESTful conventions for API design