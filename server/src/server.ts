import app from './app.js';
import { prisma } from './services/prisma.js';

const port = Number(process.env.PORT || 4000);

async function start() {
  try {
    await prisma.$connect();
    app.listen(port, () => {
      console.log(`Smart Bed Planner API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

void start();
