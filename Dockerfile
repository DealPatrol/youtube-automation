FROM node:20-bookworm-slim

# Install system deps and ffmpeg
RUN apt-get update && apt-get install -y \
  ffmpeg \
  ca-certificates \
  wget \
  gnupg \
  libnss3 \
  libatk1.0-0 \
  libgbm-dev \
  libasound2 \
  libxrandr2 \
  libxkbcommon-dev \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libatk-bridge2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Build Next.js application
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "start"]
