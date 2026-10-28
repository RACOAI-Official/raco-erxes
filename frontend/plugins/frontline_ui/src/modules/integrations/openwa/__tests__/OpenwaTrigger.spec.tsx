import { createRef, useImperativeHandle as mockUseImperativeHandle } from 'react';
import { act, render } from '@testing-library/react';
import { OpenwaTriggerForm } from '../OpenwaTrigger';

jest.mock('ui-modules', () => ({
  useAutomationRemoteFormSubmit: ({
    formRef,
    callback,
  }: {
    formRef: React.RefObject<{ submit: () => void }>;
    callback: () => void;
  }) => mockUseImperativeHandle(formRef, () => ({ submit: callback })),
}));

jest.mock('../translations', () => ({
  useOpenwaTranslation: () => ({ t: (key: string) => key }),
}));

describe('OpenWA trigger configuration', () => {
  it('saves the fixed incoming event instead of an invalid empty custom config', () => {
    const formRef = createRef<{ submit: () => void }>();
    const onSaveTriggerConfig = jest.fn();
    render(
      <OpenwaTriggerForm
        componentType="triggerForm"
        activeTrigger={{
          id: 'incoming-whatsapp',
          type: 'frontline:inbox.openwaMessages',
          label: 'WhatsApp message (OpenWA)',
          description: 'Incoming direct message',
          isCustom: true,
        }}
        formRef={formRef}
        onSaveTriggerConfig={onSaveTriggerConfig}
      />,
    );

    act(() => formRef.current?.submit());

    expect(onSaveTriggerConfig).toHaveBeenCalledWith({
      event: 'message.received',
    });
  });
});
