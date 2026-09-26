import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { getChannelMeta, CHANNEL_META_MAP } from '../channels';

describe('Channel Metadata Utilities (channels.spec.ts)', () => {
  it('should return correct metadata for each standard channel type', () => {
    const channels: ChannelType[] = [
      ChannelType.WEB_CHAT,
      ChannelType.FACEBOOK_MESSENGER,
      ChannelType.TELEGRAM,
      ChannelType.EMAIL,
      ChannelType.ZALO,
    ];

    for (const ch of channels) {
      const meta = getChannelMeta(ch);
      assert.strictEqual(meta.type, ch);
      assert.strictEqual(meta, CHANNEL_META_MAP[ch]);
      assert.ok(meta.label.length > 0);
      assert.ok(meta.iconSrc.length > 0);
      assert.ok(meta.color.length > 0);
      assert.ok(meta.badgeBg.length > 0);
      assert.ok(meta.description.length > 0);
    }
  });

  it('should normalize lowercase and mixed-case channel strings', () => {
    assert.strictEqual(getChannelMeta('web_chat').type, ChannelType.WEB_CHAT);
    assert.strictEqual(getChannelMeta('telegram').type, ChannelType.TELEGRAM);
    assert.strictEqual(getChannelMeta('Telegram').type, ChannelType.TELEGRAM);
    assert.strictEqual(getChannelMeta('facebook_messenger').type, ChannelType.FACEBOOK_MESSENGER);
    assert.strictEqual(getChannelMeta('Facebook_Messenger').type, ChannelType.FACEBOOK_MESSENGER);
    assert.strictEqual(getChannelMeta('email').type, ChannelType.EMAIL);
    assert.strictEqual(getChannelMeta('Email').type, ChannelType.EMAIL);
    assert.strictEqual(getChannelMeta('zalo').type, ChannelType.ZALO);
    assert.strictEqual(getChannelMeta('ZALO').type, ChannelType.ZALO);
    assert.strictEqual(getChannelMeta('  telegram  ').type, ChannelType.TELEGRAM);
    assert.strictEqual(getChannelMeta('\tweb_chat\n').type, ChannelType.WEB_CHAT);
  });

  it('should fallback to WEB_CHAT when channel type is unknown or invalid', () => {
    assert.strictEqual(getChannelMeta('UNKNOWN_CHANNEL').type, ChannelType.WEB_CHAT);
    assert.strictEqual(getChannelMeta('random-text').type, ChannelType.WEB_CHAT);
  });

  it('should fallback to WEB_CHAT when input is null, undefined, or empty', () => {
    assert.strictEqual(getChannelMeta(null).type, ChannelType.WEB_CHAT);
    assert.strictEqual(getChannelMeta(undefined).type, ChannelType.WEB_CHAT);
    assert.strictEqual(getChannelMeta('').type, ChannelType.WEB_CHAT);
  });
});
