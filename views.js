export function loginView() { 
  return `
    <div class="card" style="max-width:400px;margin:100px auto">
      <div class="title mb-12">Login</div>
      <form id="login-form">
        <input name="email" type="email" placeholder="Email" required class="mb-10">
        <input name="password" type="password" placeholder="Password" required class="mb-10">
        <button type="submit" class="btn-primary">Login</button>
      </form>
    </div>
  `; 
}
