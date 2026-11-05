"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A centred window for everything the platform opens: a booking, a client, a day,
 * a catalog option. Same parts as the side sheet (content, header, footer, title,
 * description), so a sheet becomes a modal by swapping the import.
 */
function Modal({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="modal" {...props} />;
}

function ModalClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="modal-close" {...props} />;
}

function ModalContent({ className, children, showCloseButton = true, ...props }: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        forceRender
        data-slot="modal-overlay"
        className="fixed inset-0 isolate z-50 bg-night/30 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="modal-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl bg-popover text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-150 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {/* The window itself scrolls, so the close button rides a sticky zero-height bar: it stays in the corner. */}
        {showCloseButton && (
          <div className="sticky top-0 z-20 h-0">
            <DialogPrimitive.Close data-slot="modal-close" render={<Button variant="close" className="absolute top-3 right-3" size="icon-sm" />}>
              <XIcon />
              <span className="sr-only">Закрыть</span>
            </DialogPrimitive.Close>
          </div>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  // Stays at the top while the window scrolls, so the title and the close button are always in sight.
  return <div data-slot="modal-header" className={cn("sticky top-0 z-10 flex flex-col gap-0.5 bg-popover p-4", className)} {...props} />;
}

function ModalFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="modal-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function ModalTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="modal-title" className={cn("font-heading text-base font-medium text-foreground", className)} {...props} />;
}

function ModalDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="modal-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Modal, ModalClose, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription };
