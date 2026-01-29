FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
# We need devDependencies for the build step (esbuild, typescript)
RUN npm ci

# Copy source code
COPY . .

# Build the server
RUN npm run server:build

# Expose the port the app runs on
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production

# Start the server (using tsx to handle paths)
CMD ["npx", "tsx", "server/index.ts"]
