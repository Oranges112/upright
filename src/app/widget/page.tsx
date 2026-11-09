import DesktopWidget from "@/components/DesktopWidget";

export const metadata = { title: "Upright widget" };

/** Page shown inside the Upright desktop app: just the floating posture pill. */
export default function WidgetPage() {
  return (
    <>
      <style>{"html,body{background:transparent!important;min-height:0!important;overflow:hidden}nextjs-portal{display:none!important}"}</style>
      <DesktopWidget />
    </>
  );
}
