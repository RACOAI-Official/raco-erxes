import type { IContext } from '~/connectionResolvers';

type AppSearchParams = { searchValue?: string; page?: number; perPage?: number };

export const appQueries = {
  async apps(
    _parent: undefined,
    { searchValue, page = 1, perPage = 20 }: AppSearchParams,
    { models, checkPermission }: IContext,
  ) {
    await checkPermission('appsManage');
    const qry: { name?: RegExp } = {};

    if (searchValue) {
      qry.name = new RegExp(`.*${searchValue}.*`, 'i');
    }

    return models.Apps.find(qry)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .sort({ createdAt: -1 });
  },

  async appsTotalCount(
    _parent: undefined,
    { searchValue }: Pick<AppSearchParams, 'searchValue'>,
    { models, checkPermission }: IContext,
  ) {
    await checkPermission('appsManage');
    const qry: { name?: RegExp } = {};

    if (searchValue) {
      qry.name = new RegExp(`.*${searchValue}.*`, 'i');
    }

    return models.Apps.countDocuments(qry);
  },

  async appDetail(
    _parent: undefined,
    { _id }: { _id: string },
    { models, checkPermission }: IContext,
  ) {
    await checkPermission('appsManage');
    return models.Apps.findOne({ _id });
  },
};
