# Gunakan Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Create uploads directory
RUN mkdir -p uploads/foto-absensi uploads/foto-karyawan

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
