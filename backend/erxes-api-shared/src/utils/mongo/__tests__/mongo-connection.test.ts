import mongoose from 'mongoose';
import { closeMongooose, connect } from '../mongo-connection';

describe('MongoDB connection lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves initial connection failures for the caller', async () => {
    const failure = new Error('Initial connection failed');
    jest.spyOn(mongoose, 'connect').mockRejectedValue(failure);
    await expect(connect()).rejects.toBe(failure);
  });

  it('does not terminate the service on a transient disconnect', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Unexpected process exit');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mongoose.connection.emit('disconnected');
    expect(exit).not.toHaveBeenCalled();
  });

  it('does not log connection strings or terminate on driver error events', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Unexpected process exit');
    });
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mongoose.connection.emit(
      'error',
      new Error('mongodb://user:private@host/db'),
    );
    expect(exit).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  });

  it('allows the graceful shutdown promise to finish', async () => {
    const close = jest
      .spyOn(mongoose.connection, 'close')
      .mockImplementation(async () => {
        mongoose.connection.emit('disconnected');
      });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    await expect(closeMongooose()).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
