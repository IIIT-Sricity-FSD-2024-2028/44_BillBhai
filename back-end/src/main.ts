import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

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

  // 3. Start the server on port 3000
  await app.listen(3000);
  console.log('----------------------------------------------------');
  console.log('🚀 BillBhai Backend is running on: http://localhost:3000');
  console.log('----------------------------------------------------');
}
bootstrap();
