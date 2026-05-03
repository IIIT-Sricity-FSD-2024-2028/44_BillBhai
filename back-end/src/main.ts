import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main entry point of the BillBhai Backend.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS: This allows your frontend (HTML/JS files) 
  // to make requests to this backend server from different origins.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-role'], // 'x-role' is essential for RBAC
  });

  // 2. Global Validation: Automatically validates incoming data 
  // against the rules defined in our DTO files (Data Transfer Objects).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. Swagger Setup: Documentation for API testing
  const config = new DocumentBuilder()
    .setTitle('BillBhai API')
    .setDescription('The BillBhai Retail Order Processing System API Documentation')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-role', in: 'header' }, 'x-role')
    .addSecurityRequirements('x-role')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 4. Export Swagger JSON: For Review-4 submission requirements
  const docsPath = path.resolve(__dirname, '..', 'docs');
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }
  fs.writeFileSync(
    path.join(docsPath, 'swagger.json'),
    JSON.stringify(document, null, 2),
  );

  // 5. Start the server on port 3000
  await app.listen(3000);
  console.log('----------------------------------------------------');
  console.log('🚀 BillBhai Backend is running on: http://localhost:3000');
  console.log('📖 Swagger Docs available at: http://localhost:3000/api');
  console.log('----------------------------------------------------');
}
bootstrap();
