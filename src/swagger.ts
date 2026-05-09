import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Taiyo Fit API',
      version: '1.0.0',
      description: 'API de gestion du studio Taiyo Fit — réservations, packs et administration.'
    },
    servers: [{ url: 'http://localhost:4000' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
}

export default swaggerJsdoc(options)
