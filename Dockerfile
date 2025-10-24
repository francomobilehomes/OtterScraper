FROM apify/actor-node-puppeteer-chrome:20

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with specific flags to avoid Puppeteer download issues
RUN npm install --only=prod --no-optional --no-audit --no-fund --no-package-lock

# Copy the rest of the application
COPY . ./

# Set the default command
CMD ["npm", "start"]
