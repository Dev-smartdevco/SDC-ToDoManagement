"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
};

const sizes = {
  sm: { width: 148, height: 36 },
  md: { width: 196, height: 48 },
  lg: { width: 280, height: 68 },
};

export function BrandLogo({ size = "md", showSubtitle = false, className }: BrandLogoProps) {
  const { t } = useI18n();
  const dim = sizes[size];

  return (
    <div className={clsx("min-w-0", className)}>
      <Image
        src="/brand/smartdevco-logo-white.png"
        alt="SmartDevCo"
        width={dim.width}
        height={dim.height}
        className="h-auto w-full max-w-[220px] object-contain object-left rtl:object-right"
        priority
      />
      {showSubtitle ? (
        <div className="mt-3">
          <div className="text-sm font-semibold tracking-wide text-white">{t("appName")}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">{t("subtitle")}</div>
        </div>
      ) : null}
    </div>
  );
}
