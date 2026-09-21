import { useMemo, useState } from 'react'
import { Check, X, Ban, ShieldHalf, Inbox } from 'lucide-react'
import {
  Button, Table, Th, Td, Tr, EmptyState, Section, useToast, Select,
} from '@/components/primitives'
import { Letterboard } from '@/components/world'
import { BackOfHouse, useSession } from '@/components/Shell'
import { MODERATION_QUEUE, MODERATION_LOG } from '@/lib/data'
import { CHANNELS, moderatedChannels, ownedChannel } from '@/lib/session'

/**
 * Channel moderation. The grant comes from a channel's owner and reaches only
 * that channel, so every screen here is scoped to the channels this account can
 * actually act on — never to the platform. A moderator on one channel has no
 * standing on another, and that is visible rather than implied.
 */
function useMyChannels() {
  const { viewer } = useSession()
  return useMemo(() => {
    const own = ownedChannel(viewer)
    const mod = moderatedChannels(viewer)
    return own ? [own, ...mod] : mod
  }, [viewer])
}

function ChannelScope({
  channels,
  value,
  onChange,
}: {
  channels: typeof CHANNELS
  value: string
  onChange: (v: string) => void
}) {
  if (channels.length < 2) return null
  return (
    <div className="w-full sm:w-64">
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Channel">
        <option value="all">All channels you moderate</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
    </div>
  )
}

/* =========================================================== comment queue */

export function ModerationQueue() {
  const channels = useMyChannels()
  const [scope, setScope] = useState('all')
  const [done, setDone] = useState<Record<string, 'kept' | 'removed' | 'blocked'>>({})
  const toast = useToast()

  const ids = channels.map((c) => c.id)
  const items = MODERATION_QUEUE.filter(
    (c) => ids.includes(c.channelId) && (scope === 'all' || c.channelId === scope) && !done[c.id],
  )

  const act = (id: string, outcome: 'kept' | 'removed' | 'blocked', who: string) => {
    setDone((d) => ({ ...d, [id]: outcome }))
    toast({
      title:
        outcome === 'kept'
          ? 'Comment published.'
          : outcome === 'removed'
            ? 'Comment removed. The author was told which channel removed it.'
            : `${who} can no longer comment on this channel.`,
      tone: outcome === 'kept' ? 'ok' : 'bad',
    })
  }

  return (
    <BackOfHouse
      title="Comment queue"
      actions={<ChannelScope channels={channels} value={scope} onChange={setScope} />}
    >
      <p className="max-w-[70ch] text-[14px] leading-relaxed text-ink-300">
        These are comments on{' '}
        {channels.length === 1 ? (
          <span className="text-ink-100">{channels[0].name}</span>
        ) : (
          <span className="text-ink-100">the {channels.length} channels you moderate</span>
        )}
        . A decision here applies to that channel alone — it does not reach the rest of the
        platform, and it does not remove the account.
      </p>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Nothing waiting"
            body="Comments arrive here when a viewer reports one, a filter holds one, or an account comments on this channel for the first time."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((c) => {
            const channel = CHANNELS.find((x) => x.id === c.channelId)
            return (
              <li
                key={c.id}
                className="rounded-lg border border-ink-700 bg-ink-850 p-4 transition-colors hover:border-ink-600"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Letterboard tone="review">{c.flag}</Letterboard>
                  <span className="font-mono text-[12px] text-ink-300">{c.at}</span>
                  {channels.length > 1 && (
                    <span className="text-[12px] text-ink-300">
                      {channel?.name} · {c.video}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-100">{c.body}</p>
                <p className="mt-2 text-[13px] text-ink-300">
                  <span className="text-ink-150">{c.who}</span>
                  {channels.length === 1 && <> · {c.video}</>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" icon={<Check className="size-3.5" />}
                    onClick={() => act(c.id, 'kept', c.who)}>
                    Publish
                  </Button>
                  <Button size="sm" icon={<X className="size-3.5" />}
                    onClick={() => act(c.id, 'removed', c.who)}>
                    Remove
                  </Button>
                  <Button size="sm" variant="danger" icon={<Ban className="size-3.5" />}
                    onClick={() => act(c.id, 'blocked', c.who)}>
                    Block from this channel
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </BackOfHouse>
  )
}

/* ================================================================ decisions */

export function ModerationHistory() {
  const channels = useMyChannels()
  const [scope, setScope] = useState('all')
  const ids = channels.map((c) => c.id)
  const rows = MODERATION_LOG.filter(
    (d) => ids.includes(d.channelId) && (scope === 'all' || d.channelId === scope),
  )

  return (
    <BackOfHouse
      title="Decisions"
      actions={<ChannelScope channels={channels} value={scope} onChange={setScope} />}
    >
      <Section title="What was decided, and by whom">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldHalf className="size-6" />}
            title="No decisions yet"
            body="Every publish, removal and block is recorded here with who made it, so a channel owner can review their moderators."
          />
        ) : (
          <div className="rounded-lg border border-ink-700 bg-ink-850">
            <Table labels={['When', 'Comment by', 'Video', 'Outcome', 'Moderator', 'Note']}>
              <thead>
                <tr>
                  <Th>When</Th><Th>Comment by</Th><Th>Video</Th>
                  <Th>Outcome</Th><Th>Moderator</Th><Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <Tr key={d.id}>
                    <Td><span className="font-mono text-[12px]">{d.at}</span></Td>
                    <Td>{d.who}</Td>
                    <Td>{d.video}</Td>
                    <Td>
                      <Letterboard
                        tone={d.outcome === 'Published' ? 'live' : d.outcome === 'Removed' ? 'dead' : 'held'}
                      >
                        {d.outcome}
                      </Letterboard>
                    </Td>
                    <Td><span className="font-mono text-[12px]">@{d.by}</span></Td>
                    <Td>
                      <span className="text-ink-300">{d.note}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Section>
    </BackOfHouse>
  )
}
