import type {
  User,
  Workspace,
  Team,
  Inbox,
  Channel,
  Label,
  Product,
  ProductVariant,
  Contact,
  ChannelIdentity,
  Conversation,
  Order,
} from '../../src/infrastructure/database';

export interface SeedContext {
  users: {
    superAdmin: User;
    admin: User;
    agent: User;
  };
  workspace: Workspace;
  team: Team;
  inbox: Inbox;
  channel: Channel;
  labels: Record<string, Label>;
  products: Product[];
  variants: ProductVariant[];
  contacts: Contact[];
  channelIdentities: ChannelIdentity[];
  conversations: Conversation[];
  orders: Order[];
}
