<main @class(['page', 'active' => $active]) g-scope="Page">
  <h1>{{ $title }}</h1>
  <button @click="open = !open">Toggle</button>
  <div *if="open">{message}</div>
</main>
