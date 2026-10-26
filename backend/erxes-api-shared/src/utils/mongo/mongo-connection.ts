// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import mongoose from 'mongoose';

const { MONGO_URL = 'mongodb://127.0.0.1:27017/erxes?directConnection=true' } =
  process.env;

export const mongooseConnectionOptions: mongoose.ConnectOptions = {
  family: 4,
};

mongoose.connection
  .on('connected', () => {
    console.info('MongoDB connected.');
  })
  .on('disconnected', () => {
    // A disconnect may be temporary, or part of an intentional shutdown.
    // Let the driver reconnect and let shutdown handlers finish their work.
    console.warn('MongoDB disconnected.');
  })
  .on('error', (error: Error) => {
    console.error('MongoDB connection error:', error.name);
  });

export async function connect(): Promise<mongoose.Connection> {
  if (!MONGO_URL) {
    throw new Error('MONGO_URL is not defined');
  }

  await mongoose.connect(MONGO_URL, mongooseConnectionOptions);
  return mongoose.connection;
}

export async function closeMongooose(): Promise<void> {
  try {
    await mongoose.connection.close();
    console.info('MongoDB connection closed.');
  } catch (error: unknown) {
    console.error(
      'Could not close MongoDB connection:',
      error instanceof Error ? error.name : 'UnknownError',
    );
  }
}
