# Step 1: Use Node image
FROM node:18-alpine

# Step 2: Set working directory
WORKDIR /app

# Step 3: Copy package files
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy rest of the app
COPY . .

# Step 6: Build React app
RUN npm run build

# Step 7: Install serve to serve build files
RUN npm install -g serve

# Step 8: Expose port
EXPOSE 3000

# Step 9: Run the app
CMD ["serve", "-s", "build", "-l", "3000"]
