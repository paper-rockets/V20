import React from 'react';
import { ProRail } from './ProRail';
import { ProPanel, ProPanelProps } from './ProPanel';

export type ProShellProps = ProPanelProps & {
  onOpenIllumination?: () => void;
  isIlluminationOpen?: boolean;
};

export const ProShell: React.FC<ProShellProps> = (props) => {
  return (
    <>
      <ProRail
        theme={props.theme}
        tool={props.tool}
        setTool={props.setTool}
        brushSettings={props.brushSettings}
        setBrushSettings={props.setBrushSettings}
        onOpenColorStudio={props.onOpenColorStudio}
        onOpenIllumination={props.onOpenIllumination}
        isIlluminationOpen={props.isIlluminationOpen}
      />
      <ProPanel {...props} />
    </>
  );
};
