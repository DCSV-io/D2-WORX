<script lang="ts">
  import * as Card from "$lib/client/components/ui/card/index.js";
  import * as m from "$lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.webclient_app_profile_title()} — {m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_app_profile_description()}
  />
  <meta
    property="og:title"
    content="{m.webclient_app_profile_title()} — {m.webclient_nav_brand()}"
  />
  <meta
    property="og:description"
    content={m.webclient_app_profile_description()}
  />
  <meta
    property="og:type"
    content="website"
  />
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold tracking-tight">{m.webclient_app_profile_title()}</h1>

  <Card.Card>
    <Card.CardHeader>
      <Card.CardTitle>{m.webclient_app_profile_your_profile()}</Card.CardTitle>
      <Card.CardDescription>{m.webclient_app_profile_manage_info()}</Card.CardDescription>
    </Card.CardHeader>
    <Card.CardContent>
      <p class="text-muted-foreground text-sm">{m.webclient_app_profile_placeholder()}</p>
    </Card.CardContent>
  </Card.Card>
</div>
