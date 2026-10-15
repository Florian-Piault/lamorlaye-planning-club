import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { type ThemePreference, useThemePreference } from "@/app/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

/** Apparence : thème clair, sombre ou celui du système, mémorisé sur ce poste. */
export function AppearanceCard() {
  const [preference, setPreference] = useThemePreference();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Apparence</CardTitle>
        <CardDescription>
          Le thème « Système » suit le réglage clair ou sombre du poste.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="inline-flex gap-1 rounded-lg border bg-muted p-1">
          <legend className="sr-only">Thème</legend>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                preference === value && "bg-card text-foreground shadow-xs",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {label}
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
