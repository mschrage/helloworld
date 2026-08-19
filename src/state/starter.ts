import { makeStyle } from '../lib/theme'
import type { DiagramEdge, DiagramNode, EdgeEnd, Scene, ShapeKind } from '../types'

const node = (
  id: string,
  kind: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  extra: Partial<DiagramNode> = {},
): DiagramNode => ({
  id,
  kind,
  x,
  y,
  w,
  h,
  text,
  style: { ...makeStyle(kind), ...(extra.style ?? {}) },
  ...('tag' in extra ? { tag: extra.tag } : {}),
})

const edge = (
  id: string,
  from: EdgeEnd,
  to: EdgeEnd,
  extra: Partial<DiagramEdge> = {},
): DiagramEdge => ({
  id,
  from,
  to,
  routing: 'orthogonal',
  startCap: 'none',
  endCap: 'arrow',
  label: '',
  style: { stroke: 'solid', weight: 1, fontSize: 11 },
  ...extra,
})

/** The scene a first-time visitor lands on — a small, real architecture. */
export function starterScene(): Scene {
  const nodes: DiagramNode[] = [
    node('t1', 'text', -688, 12, 520, 30, 'Order placement — request lifecycle', {
      style: { ...makeStyle('text'), fontSize: 18, bold: true, align: 'left' },
    }),
    node('t2', 'text', -688, 44, 520, 24, 'v2 · draft · owner: platform', {
      style: { ...makeStyle('text'), fontSize: 11, align: 'left', mono: true },
    }),

    node('fr1', 'frame', 200, 96, 792, 208, 'ORDER DOMAIN'),

    node('client', 'actor', -688, 208, 108, 96, 'Customer'),
    node('cdn', 'cloud', -520, 196, 168, 108, 'CDN / WAF'),
    node('gw', 'round', -272, 216, 176, 76, 'API Gateway', { tag: 'edge' }),
    node('auth', 'diamond', -24, 202, 160, 108, 'Token valid?'),
    node('idp', 'round', -280, 400, 176, 72, 'Identity Provider', { tag: 'oidc' }),
    node('orders', 'round', 232, 136, 176, 76, 'Orders Service', { tag: 'svc' }),
    node('bus', 'queue', 480, 140, 184, 68, 'orders.placed'),
    node('worker', 'round', 736, 136, 176, 76, 'Fulfilment Worker', { tag: 'svc' }),
    node('pg', 'cylinder', 246, 372, 148, 104, 'orders_db'),
    node('cache', 'cylinder', 480, 372, 148, 104, 'read cache'),
    node(
      'note',
      'note',
      736, 356,
      200, 116,
      'Worker is idempotent — retries key off order_id. Dead letters land in orders.dlq.',
    ),
    node('reject', 'pill', 24, 400, 160, 48, '401 Unauthorized'),
  ]

  const edges: DiagramEdge[] = [
    edge('e1', { node: 'client', side: 'e' }, { node: 'cdn', side: 'w' }),
    edge('e2', { node: 'cdn', side: 'e' }, { node: 'gw', side: 'w' }, { label: 'https' }),
    edge('e3', { node: 'gw', side: 'e' }, { node: 'auth', side: 'w' }),
    edge(
      'e4',
      { node: 'gw', side: 's' },
      { node: 'idp', side: 'n' },
      { routing: 'curve', style: { stroke: 'dashed', weight: 1, fontSize: 11 }, label: 'introspect' },
    ),
    edge('e5', { node: 'auth', side: 'n' }, { node: 'orders', side: 'w' }, { label: 'yes' }),
    edge('e6', { node: 'auth', side: 's' }, { node: 'reject', side: 'n' }, { label: 'no' }),
    edge('e7', { node: 'orders', side: 'e' }, { node: 'bus', side: 'w' }, { label: 'publish' }),
    edge('e8', { node: 'bus', side: 'e' }, { node: 'worker', side: 'w' }, { label: 'consume' }),
    edge('e9', { node: 'orders', side: 's' }, { node: 'pg', side: 'n' }, { label: 'write' }),
    edge(
      'e10',
      { node: 'bus', side: 's' },
      { node: 'cache', side: 'n' },
      { style: { stroke: 'dotted', weight: 1, fontSize: 11 }, label: 'invalidate' },
    ),
    edge(
      'e11',
      { node: 'note', side: 'n' },
      { node: 'worker', side: 's' },
      { endCap: 'none', routing: 'straight', style: { stroke: 'dotted', weight: 1, fontSize: 11 } },
    ),
  ]

  return { title: 'Order placement', nodes, edges, ink: [] }
}
