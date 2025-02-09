# syntax=docker/dockerfile:1

# Build stage
FROM node:23-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
RUN npm install

# Install dotenv package
RUN npm install dotenv

# Set build environment variables directly instead of using .env file
ENV SKIP_PREFLIGHT_CHECK=true \
    DISABLE_ESLINT_PLUGIN=true \
    CI=false

# Copy source files
COPY public ./public
COPY src ./src

# Debug: List contents
RUN echo "Contents before build:"
RUN ls -la

# Build React app with verbose logging
RUN NODE_ENV=production npm run build

# Verify build
RUN echo "Build directory contents:" && ls -la build/

# Production stage
#FROM node:18-alpine AS production
FROM node:23-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install dotenv package
RUN npm install dotenv

# Copy build artifacts and server files
COPY --from=builder /app/build ./build
COPY src/server.js ./src/
COPY db ./db

# Verify files
RUN echo "Production files:" && ls -la
RUN echo "Build directory:" && ls -la build/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
