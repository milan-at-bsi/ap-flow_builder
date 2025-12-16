FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy OpenAPI spec to dist
RUN cp openapi.yaml dist/

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
