# syntax=docker/dockerfile:1.4

# Build stage
#FROM node:23-alpine AS builder
#FROM demonstrationorg/dhi-temurin:23.0-alpine3.21-dev_chucklesdev AS builder
FROM demonstrationorg/dhi-temurin:23.0-alpine3.21-dev_chucklesdev AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
RUN npm install

# Install dotenv package
RUN npm install dotenv

# Install missing Babel plugin
RUN npm install --save-dev @babel/plugin-proposal-private-property-in-object

# Install complete Babel preset for React
RUN npm install --save-dev @babel/preset-react @babel/plugin-proposal-private-property-in-object

# Install all Babel dependencies at once
RUN npm install --save-dev \
    @babel/core \
    @babel/preset-env \
    @babel/preset-react \
    @babel/plugin-proposal-private-property-in-object \
    @babel/plugin-transform-private-property-in-object \
    babel-preset-react-app

# Set build environment variables directly instead of using .env file
ENV SKIP_PREFLIGHT_CHECK=true \
    DISABLE_ESLINT_PLUGIN=true \
    CI=false \
    BABEL_DISABLE_CACHE=1

# Copy source files
COPY public ./public
COPY src ./src

# Debug: List contents
RUN echo "Contents before build:"
RUN ls -la

# Build React app with verbose logging
RUN NODE_ENV=production npm run build

# Clear any existing babel cache and build
RUN npm run build --verbose

# Verify build
RUN echo "Build directory contents:" && ls -la build/

# Production stage
#FROM node:23-alpine AS production
#FROM node:23.10.0-alpine3.21 AS production
#FROM node:23.10.0-slim AS production
FROM demonstrationorg/dhi-temurin:23.0-alpine3.21-dev_chucklesdev AS production


WORKDIR /app

# Create a non-root user and group
#RUN addgroup -S appgroup && adduser -S appuser -G appgroup

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

# Switch to the non-root user
USER appuser

EXPOSE 3001

CMD ["npm", "start"]
