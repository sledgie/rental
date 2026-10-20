// One shared lock for page scrolling. Drawers and dialogs can stack and close in any order, so a plain
// "save and restore body.style.overflow" pair can leave the page stuck on overflow:hidden. A counter cannot.
let locks = 0;
export function lockScroll(): () => void {
  if (locks++ === 0) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = "";
  };
}
