import type { IContext } from '~/connectionResolvers';
import { appQueries } from '../graphql/queries';

const row = { _id: 'app-fixture', name: 'Synthetic app', token: 'fixture-secret' };
const sort = jest.fn();
const limit = jest.fn(() => ({ sort }));
const skip = jest.fn(() => ({ limit }));
const find = jest.fn(() => ({ skip }));
const countDocuments = jest.fn();
const findOne = jest.fn();
const checkPermission = jest.fn();
const context = { models: { Apps: { find, countDocuments, findOne } }, checkPermission } as unknown as IContext;
const queries = [
  () => appQueries.apps(undefined, { page: 2, perPage: 5, searchValue: 'Synthetic' }, context),
  () => appQueries.appsTotalCount(undefined, { searchValue: 'Synthetic' }, context),
  () => appQueries.appDetail(undefined, { _id: row._id }, context),
];

beforeEach(() => {
  jest.clearAllMocks();
  sort.mockResolvedValue([row]);
  countDocuments.mockResolvedValue(1);
  findOne.mockResolvedValue(row);
  checkPermission.mockResolvedValue(undefined);
});

describe('app query permission boundary', () => {
  it.each(queries.map((run, index) => [index, run] as const))(
    'rejects query %s before accessing records or token fields',
    async (_index, run) => {
      checkPermission.mockRejectedValue(new Error('OAuth scope required'));
      await expect(run()).rejects.toThrow('OAuth scope required');
      expect(checkPermission).toHaveBeenCalledWith('appsManage');
      expect(find).not.toHaveBeenCalled();
      expect(countDocuments).not.toHaveBeenCalled();
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  it('keeps authorized list filtering, pagination and result unchanged', async () => {
    await expect(queries[0]()).resolves.toEqual([row]);
    expect(checkPermission).toHaveBeenCalledWith('appsManage');
    expect(find).toHaveBeenCalledWith({ name: /.*Synthetic.*/i });
    expect(skip).toHaveBeenCalledWith(5);
    expect(limit).toHaveBeenCalledWith(5);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(checkPermission.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0]);
  });

  it('keeps authorized count behavior unchanged', async () => {
    await expect(queries[1]()).resolves.toBe(1);
    expect(checkPermission).toHaveBeenCalledWith('appsManage');
    expect(countDocuments).toHaveBeenCalledWith({ name: /.*Synthetic.*/i });
  });

  it('keeps authorized detail behavior unchanged', async () => {
    await expect(queries[2]()).resolves.toEqual(row);
    expect(checkPermission).toHaveBeenCalledWith('appsManage');
    expect(findOne).toHaveBeenCalledWith({ _id: row._id });
  });
});
