import type { WidgetShellProps } from "@piiq/workspace-plugin-sdk";
import type { SVGAttributes } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";

export function PluginIcon(props: SVGAttributes<SVGSVGElement> & { id: string }) {
  return <Icon {...props} id={props.id as IconId} />;
}

export function PluginWidgetShell({
  children,
  toolbar,
  data,
  ...props
}: WidgetShellProps) {
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  return (
    <DraggableCard
      {...props}
      aiData={data}
      aiEnabled={true}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={toolbar}
    >
      {children}
    </DraggableCard>
  );
}
