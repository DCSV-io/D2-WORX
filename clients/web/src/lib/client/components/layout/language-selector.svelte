<script lang="ts">
  import LanguagesIcon from "@lucide/svelte/icons/languages";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/client/components/ui/dropdown-menu/index.js";
  import { getLocale, setLocale } from "$lib/paraglide/runtime";
  import * as m from "$lib/paraglide/messages.js";

  const locales = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
    { code: "ja", label: "日本語" },
  ] as const;
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        aria-label={m.webclient_language_label()}
      >
        <LanguagesIcon class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    {#each locales as locale (locale.code)}
      <DropdownMenu.Item onclick={() => setLocale(locale.code)}>
        {locale.label}
        {#if getLocale() === locale.code}
          <CheckIcon class="ml-auto size-4" />
        {/if}
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
