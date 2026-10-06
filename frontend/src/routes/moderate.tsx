import { useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { NotAvailableYet } from '@/components/primitives'
import { BackOfHouse, useSession } from '@/components/Shell'
import { moderatedChannels, ownedChannel } from '@/lib/session'

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

/* =========================================================== comment queue */

/**
 * Comments held for a channel moderator.
 *
 * <p>Both screens ran entirely on fixtures: the queue listed invented comments,
 * and approving or removing one changed a value in this component that the next
 * page load discarded — while telling the moderator the author had been
 * notified. Nothing on the server stores a comment, so there is no queue to
 * show and no decision to record.
 */
export function ModerationQueue() {
  const channels = useMyChannels()
  return (
    <BackOfHouse title="Comment queue">
      <NotAvailableYet
        what="Comment moderation"
        icon={<MessageSquare className="size-7" />}
        body={`Comments awaiting a decision on ${
          channels.length === 1 ? channels[0].name : 'your channels'
        } will be listed here, with keep, remove and block on each. Comments are not stored yet, so nothing reaches this queue.`}
      />
    </BackOfHouse>
  )
}

/* ================================================================ decisions */

export function ModerationHistory() {
  return (
    <BackOfHouse title="Decisions">
      <NotAvailableYet
        what="Moderation decisions"
        icon={<MessageSquare className="size-7" />}
        body="Every decision a moderator makes, and who made it, is recorded here so a removal
          can always be traced back to a person. It opens with the comment queue."
      />
    </BackOfHouse>
  )
}
