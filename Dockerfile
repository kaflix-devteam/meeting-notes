FROM node:20-alpine

WORKDIR /app

# Install frontend dependencies and build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

COPY frontend ./frontend

# Build frontend → backend/public
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

COPY backend ./backend

RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build
RUN cp -r backend/src/prompts backend/dist/prompts

# Remove devDependencies
RUN cd backend && npm prune --omit=dev

# Create uploads directory
RUN mkdir -p /app/backend/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "dist/app.js"]
