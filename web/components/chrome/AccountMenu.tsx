"use client";

import Link from "next/link";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { Popover } from "./Popover";
import { COPY } from "@/lib/brand";

/**
 * Avatar trigger. v0 is single-user and local-first, so there is no session to
 * sign out of and nothing to upgrade — the menu says where the data lives and
 * offers the one entry point that exists.
 */
export function AccountMenu() {
  return (
    <Popover
      label={COPY.account}
      triggerLabel={COPY.account}
      trigger={
        <span className="grid size-7 place-items-center rounded-full border border-hairline bg-field font-mono text-2xs text-muted">
          A
        </span>
      }
      triggerClassName="grid size-9 shrink-0 place-items-center rounded-md transition-transform duration-150 active:scale-[0.96]"
      panelClassName="w-56 max-w-[calc(100vw-1.5rem)]"
    >
      {({ close }) => (
        <div className="p-1">
          <div className="px-2.5 py-2">
            <p className="text-sm text-ink">Akun lokal</p>
            <p className="mt-0.5 text-2xs leading-4 text-muted">
              Proyek disimpan di perangkat ini.
            </p>
          </div>
          <div className="border-t border-hairline pt-1">
            <Link
              href="/settings"
              onClick={close}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink transition-colors duration-150 hover:bg-field"
            >
              <GearIcon size={15} weight="regular" className="text-muted" />
              Pengaturan
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}
