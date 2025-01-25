import type { MultipleOccupancyGroupStatus, SmartBridge } from 'lutron-leap'

import { log } from 'node:console'

import { Response } from 'lutron-leap'
import { describe, expect, it } from 'vitest'

import { OccupancySensorRouter } from './OccupancySensorRouter.js'

it('router is static', () => {
  const r1 = OccupancySensorRouter.getInstance()
  const r2 = OccupancySensorRouter.getInstance()

  expect(r1).toBe(r2)
})

describe('router sets initial state', () => {
  let subCB: (_r: Response) => void = function (_r: Response): void {
    log(_r)
    // this gets replaced, and can be used to simulate the bridge calling the subscription handler callback
  }

  const initialStatus: Response = Response.fromJSON({
    CommuniqueType: 'SubscribeResponse',
    Header: {
      MessageBodyType: 'MultipleOccupancyGroupStatus',
      StatusCode: '200 OK',
      Url: '/occupancygroup/status',
    },
    Body: {
      OccupancyGroupStatuses: [
        {
          href: '/occupancygroup/1/status',
          OccupancyGroup: {
            href: '/occupancygroup/1',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/2/status',
          OccupancyGroup: {
            href: '/occupancygroup/2',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/3/status',
          OccupancyGroup: {
            href: '/occupancygroup/3',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/4/status',
          OccupancyGroup: {
            href: '/occupancygroup/4',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/5/status',
          OccupancyGroup: {
            href: '/occupancygroup/5',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/6/status',
          OccupancyGroup: {
            href: '/occupancygroup/6',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/7/status',
          OccupancyGroup: {
            href: '/occupancygroup/7',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/8/status',
          OccupancyGroup: {
            href: '/occupancygroup/8',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/9/status',
          OccupancyGroup: {
            href: '/occupancygroup/9',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/10/status',
          OccupancyGroup: {
            href: '/occupancygroup/10',
          },
          OccupancyStatus: 'Unknown',
        },
        {
          href: '/occupancygroup/11/status',
          OccupancyGroup: {
            href: '/occupancygroup/11',
          },
          OccupancyStatus: 'Unoccupied',
        },
      ],
    },
  })

  const updatedStatus: Response = Response.fromJSON({
    CommuniqueType: 'ReadResponse',
    Header: {
      MessageBodyType: 'MultipleOccupancyGroupStatus',
      StatusCode: '200 OK',
      Url: '/occupancygroup/status',
      ClientTag: '8b73ef78-8af0-41d8-96f6-16eb18cf43a4',
    },
    Body: {
      OccupancyGroupStatuses: [
        {
          href: '/occupancygroup/11/status',
          OccupancyGroup: {
            href: '/occupancygroup/11',
          },
          OccupancyStatus: 'Occupied',
        },
      ],
    },
  })

  function mockSub(cb: (_r: Response) => void): Promise<MultipleOccupancyGroupStatus> {
    subCB = cb
    return Promise.resolve(initialStatus.Body! as MultipleOccupancyGroupStatus)
  }

  const mockBridge = {
    bridgeID: 'fakebridge',
    subscribeToOccupancy: mockSub,
    on: (_event: any): void => { log(_event) },
  }

  it('initial and update', async () => {
    const r = OccupancySensorRouter.getInstance()
    let state = 'obviously wrong string'
    const mockCB = (_state: string): void => {
      state = _state
    }
    await r.register(mockBridge as unknown as SmartBridge, { href: '/occupancygroup/11' }, mockCB)
    // initial state
    expect(state).toEqual('Unoccupied')

    // after update
    subCB(updatedStatus)
    expect(state).toEqual('Occupied')
  })
})
