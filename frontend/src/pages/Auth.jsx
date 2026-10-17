
import React, { useState } from "react";
import { api, setToken, setUser } from "../services/api";

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api.register({
          username: username.trim(),
          email: email.trim(),
          password,
          role: "staff",
        });

        setMessage("Account created successfully. Please log in.");
        setMode("login");
        setPassword("");
      } else {
        const result = await api.login(username.trim(), password);

        if (!result.access_token) {
          throw new Error("The server did not return an access token.");
        }

        setToken(result.access_token);

        const user = result.user || await api.getMe();
        setUser(user);
        onAuthenticated(user);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">
            📦
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Intelligent Inventory
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Inventory and Warehouse Management System
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg py-2 font-medium ${
              mode === "login"
                ? "bg-white text-blue-700 shadow"
                : "text-slate-500"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg py-2 font-medium ${
              mode === "register"
                ? "bg-white text-blue-700 shadow"
                : "text-slate-500"
            }`}
          >
            Sign Up
          </button>
        </div>

        <h2 className="mb-1 text-xl font-semibold text-slate-800">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          {mode === "login"
            ? "Enter your username or email to continue."
            : "Enter your details to register."}
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username or email
            </label>
            <input
              id="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter username or email"
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secure access to your inventory and warehouse operations.
        </p>
      </div>
    </div>
  );
}
