import { Service, PlatformAccessory } from 'homebridge';

import { LutronCasetaLeap } from './platform';
import { ExceptionDetail, OneButtonStatusEvent, Response, SmartBridge, ButtonDefinition } from 'lutron-leap';

import { inspect } from 'util';

// This maps DeviceType and ButtonNumber to human-readable labels and
// ServiceLabelIndex values. n.b. the labels are not shown in Apple's Home app,
// but are shown in other apps. The index value determines the order that
// buttons are shown in the Home app. They're ordered top-to-bottom (as they
// appear on the physical remote) in this map.
//
// [
//     $DeviceType,
//     new Map([
//         [$ButtonNumber, { label: '...', index: ... }],
//         ...
//     ]),
// ]
const BUTTON_MAP = new Map<string, Map<number, { label: string; index: number }>>([
    [
        'Pico2Button',
        new Map([
            [0, { label: 'On', index: 1 }],
            [2, { label: 'Off', index: 2 }],
        ]),
    ],
    [
        'Pico2ButtonRaiseLower',
        new Map([
            [0, { label: 'On', index: 1 }],
            [2, { label: 'Off', index: 4 }],
            [3, { label: 'Raise', index: 2 }],
            [4, { label: 'Lower', index: 3 }],
        ]),
    ],
    [
        'Pico3Button',
        new Map([
            [0, { label: 'On', index: 1 }],
            [1, { label: 'Center', index: 2 }],
            [2, { label: 'Off', index: 3 }],
        ]),
    ],
    [
        'Pico3ButtonRaiseLower',
        new Map([
            [0, { label: 'On', index: 1 }],
            [1, { label: 'Center', index: 3 }],
            [2, { label: 'Off', index: 5 }],
            [3, { label: 'Raise', index: 2 }],
            [4, { label: 'Lower', index: 4 }],
        ]),
    ],
    [
        'Pico4Button2Group',
        new Map([
            [1, { label: 'Group 1 On', index: 1 }],
            [2, { label: 'Group 1 Off', index: 2 }],
            [3, { label: 'Group 2 On', index: 3 }],
            [4, { label: 'Group 2 Off', index: 4 }],
        ]),
    ], [
        'Pico4ButtonScene',
        new Map([
            [1, { label: 'Button 1', index: 1 }],
            [2, { label: 'Button 2', index: 2 }],
            [3, { label: 'Button 3', index: 3 }],
            [4, { label: 'Button 4', index: 4 }],
        ]),
    ],
    [
        'Pico4ButtonZone',
        new Map([
            [1, { label: 'Button 1', index: 1 }],
            [2, { label: 'Button 2', index: 2 }],
            [3, { label: 'Button 3', index: 3 }],
            [4, { label: 'Button 4', index: 4 }],
        ]),
    ],
    // TODO
    /*
    ['Pico4Button', new Map([
    ])]
   */
]);

export class PicoRemote {
    private services: Map<string, Service> = new Map();

    constructor(
        private readonly platform: LutronCasetaLeap,
        private readonly accessory: PlatformAccessory,
        private readonly bridge: Promise<SmartBridge>,
    ) {
        const fullName = accessory.context.device.FullyQualifiedName.join(' ');

        this.accessory
            .getService(this.platform.api.hap.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Lutron Electronics Co., Inc')
            .setCharacteristic(this.platform.api.hap.Characteristic.Model, this.accessory.context.device.ModelNumber)
            .setCharacteristic(
                this.platform.api.hap.Characteristic.SerialNumber,
                this.accessory.context.device.SerialNumber.toString(),
            );

        const label_svc =
            this.accessory.getService(this.platform.api.hap.Service.ServiceLabel) ||
            this.accessory.addService(this.platform.api.hap.Service.ServiceLabel);
        label_svc.setCharacteristic(
            this.platform.api.hap.Characteristic.ServiceLabelNamespace,
            this.platform.api.hap.Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS, // ha ha
        );

        (async () => {
            const bridge = await this.bridge;

            let bgs;
            try {
                // TODO some remotes return multiple button groups. make this support them.
                // see https://github.com/gurumitts/pylutron-caseta/pull/84
                bgs = await bridge.getButtonGroupsFromDevice(this.accessory.context.device);
            } catch (e) {
                this.platform.log.error('Failed to get button group(s) belonging to', fullName, e);
                throw e;
            }

            bgs.forEach(bg => {
                if (bg instanceof ExceptionDetail) {
                    throw new Error('device has been removed');
                }
            });

            // TODO make this behavior optional. a user may want to
            // hide remotes that are already associated with
            // devices
            /*
               if (bg.AffectedZones !== undefined) {
               return;
               }
               */

            let buttons:ButtonDefinition[] = [];
            for (const bg of bgs) {
                try {
                    buttons = buttons.concat(await bridge.getButtonsFromGroup(bg));
                } catch (e) {
                    this.platform.log.error('Failed to get buttons from button group', bg.href);
                    throw e;
                }
            }

            for (const button of buttons) {
                const dentry = BUTTON_MAP.get(this.accessory.context.device.DeviceType);
                if (dentry === undefined) {
                    throw new Error(`Could not find ${this.accessory.context.device.DeviceType} in button map`);
                }
                const alias = dentry.get(button.ButtonNumber);
                if (alias === undefined) {
                    throw new Error(
                        `Could not find button ${button.ButtonNumber} in ${this.accessory.context.device.DeviceType} map entry`,
                    );
                }

                this.platform.log.debug(
                    `setting up ${button.href} named ${button.Name} numbered ${button.ButtonNumber} as ${inspect(
                        alias,
                        true,
                        null,
                    )}`,
                );

                const service =
                    this.accessory.getServiceById(
                        this.platform.api.hap.Service.StatelessProgrammableSwitch,
                        alias.label,
                    ) ||
                    this.accessory.addService(
                        this.platform.api.hap.Service.StatelessProgrammableSwitch,
                        button.Name,
                        alias.label,
                    );
                service.addLinkedService(label_svc);

                service.setCharacteristic(this.platform.api.hap.Characteristic.Name, alias.label);
                service.setCharacteristic(this.platform.api.hap.Characteristic.ServiceLabelIndex, alias.index);

                // TODO add timers to track double- and long-presses, remove this line
                service
                    .getCharacteristic(this.platform.api.hap.Characteristic.ProgrammableSwitchEvent)
                    .setProps({ maxValue: 0 });

                this.services.set(button.href, service);

                this.platform.log.debug(`subscribing to ${button.href} events`);
                bridge.subscribeToButton(button, this.handleEvent.bind(this));
            }
        })()
            .then(() => this.platform.log.info('Finished setting up Pico remote', fullName))
            .catch((e) => {
                this.platform.log.error('Failed setting up Pico remote:', e);
            });

        this.platform.on('unsolicited', this.handleUnsolicited.bind(this));
    }

    handleEvent(response: Response): void {
        const evt = (response.Body! as OneButtonStatusEvent).ButtonStatus;
        const svc = this.services.get(evt.Button.href);
        this.platform.log.debug('handling event from button ', evt.Button.href);
        if (svc !== undefined) {
            if (evt.ButtonEvent.EventType === 'Release') {
                this.platform.log.info(
                    'Button ',
                    evt.Button.href,
                    'on Pico remote',
                    this.accessory.context.device.FullyQualifiedName.join(' '),
                    'was released; notifying Homekit',
                );
                svc.getCharacteristic(this.platform.api.hap.Characteristic.ProgrammableSwitchEvent).updateValue(
                    this.platform.api.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
                );
            } else {
                this.platform.log.debug('button ', evt.Button.href, ' was ', evt.ButtonEvent.EventType);
            }
        } else {
            this.platform.log.warn(
                'Pico remote',
                this.accessory.context.device.FullyQualifiedName.join(' '),
                'got an event from unknown button',
                evt.Button.href,
            );
        }
    }

    handleUnsolicited(response: Response): void {
        if (response.Header.MessageBodyType === 'OneButtonStatusEvent') {
            const href = (response.Body as OneButtonStatusEvent)?.ButtonStatus.Button.href;
            if (this.services.has(href)) {
                this.platform.log.warn('got unsolicited response for known button ', href, ', handling anyway');
                this.handleEvent(response);
            }
        }
    }
}
