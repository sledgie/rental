// React 18 has no useActionState / form actions (React 19 / Next), so these small equivalents drive the module's forms.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { NotFoundError, useVersion } from "./store";

export function useActionState<S extends { ok: boolean; message: string; errors: string[]; warnings: string[] }>(
  action: (prev: S, fd: FormData) => Promise<S>,
  initial: S,
): [S, (fd: FormData) => void, boolean] {
  const [state, setState] = useState<S>(initial);
  const [pending, setPending] = useState(false);
  const latest = useRef(state);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const run = useCallback(
    (fd: FormData) => {
      setPending(true);
      action(latest.current, fd)
        .then((next) => {
          latest.current = next;
          if (mounted.current) setState(next);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          const next = { ...initial, ok: false, message, errors: [message], warnings: [] } as S;
          latest.current = next;
          if (mounted.current) setState(next);
        })
        .finally(() => {
          if (mounted.current) setPending(false);
        });
    },
    [action, initial],
  );
  return [state, run, pending];
}

/** Spread onto <form> in place of `action={formAction}`. */
export function formProps(run: (fd: FormData) => void) {
  return {
    onSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
      let fd: FormData;
      try {
        fd = new FormData(e.currentTarget, submitter as HTMLElement | null);
      } catch {
        fd = new FormData(e.currentTarget);
      }
      run(fd);
    },
  };
}

/**
 * Renders the result of an async "server component" function. The previous output stays on screen while data reloads so
 * dialogs and typed input survive a refresh after a write.
 */
export function AsyncView({ render, deps, fallback }: { render: () => Promise<ReactNode>; deps: unknown[]; fallback?: ReactNode }) {
  const version = useVersion();
  const [node, setNode] = useState<ReactNode>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState("");
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => renderRef.current())
      .then((out) => {
        if (!live) return;
        setNode(out);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!live) return;
        if (error instanceof NotFoundError) setState("missing");
        else {
          console.error(error);
          setMessage(error instanceof Error ? error.message : String(error));
          setState("error");
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  if (state === "missing") return <p className="dp-note">That record could not be found.</p>;
  if (state === "error") return <p className="dp-note">Could not load this view: {message}</p>;
  if (state === "loading" && node == null) return <>{fallback ?? <p className="dp-note">Loading deposits...</p>}</>;
  return <>{node}</>;
}
