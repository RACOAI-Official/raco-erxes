import type { IContext } from '~/connectionResolvers';
import { visibleChannelsFilter } from '@/channel/utils';
import { getOpenwaConfig } from './contract';
import { composeOpenwaMessage, composeOpenwaSchema } from './outbound';
import { z } from 'zod';

export const openwaMutations = {
  async frontlineOpenwaCompose(
    _root: unknown,
    input: z.infer<typeof composeOpenwaSchema>,
    context: IContext,
  ) {
    const { user, models, subdomain, checkPermission } = context;
    if (!user) throw new Error('Authentication required');
    await checkPermission('conversationMessageAdd');
    const config = getOpenwaConfig();
    if (subdomain !== config.subdomain)
      throw new Error('OpenWA tenant mismatch');
    const integration = await models.Integrations.findOne({
      _id: config.integrationId,
      kind: 'openwa-messenger',
      isActive: { $ne: false },
    });
    const visible = await visibleChannelsFilter({ models, subdomain, user });
    if (
      !integration?.channelId ||
      !(await models.Channels.exists({
        $and: [{ _id: integration.channelId }, visible],
      }))
    )
      throw new Error('You do not have access to this WhatsApp inbox');
    return composeOpenwaMessage(subdomain, input, { userId: user._id });
  },
};
