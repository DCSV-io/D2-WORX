<script lang="ts">
  import * as Card from "$lib/client/components/ui/card/index.js";
  import * as m from "$lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.common_ui_dashboard()} — {m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_app_dashboard_description()}
  />
  <meta
    property="og:title"
    content="{m.common_ui_dashboard()} — {m.webclient_nav_brand()}"
  />
  <meta
    property="og:description"
    content={m.webclient_app_dashboard_description()}
  />
  <meta
    property="og:type"
    content="website"
  />
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Overview</Card.CardTitle>
        <Card.CardDescription>Summary of your account activity.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Dashboard content will be built in Step 10.</p>
      </Card.CardContent>
    </Card.Card>

    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Recent Activity</Card.CardTitle>
        <Card.CardDescription>Latest events in your organization.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Activity feed placeholder.</p>
      </Card.CardContent>
    </Card.Card>

    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Quick Actions</Card.CardTitle>
        <Card.CardDescription>Frequently used operations.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Quick actions placeholder.</p>
      </Card.CardContent>
    </Card.Card>
  </div>
</div>
