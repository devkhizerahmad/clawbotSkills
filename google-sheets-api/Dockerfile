# Use a slim version of Node for a smaller image size
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache for layers
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your project code
COPY . .

# OpenClaw usually runs on 18789
EXPOSE 18789

# The command to start your gateway
CMD ["npx", "openclaw", "gateway", "start"]