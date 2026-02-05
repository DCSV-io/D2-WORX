// -----------------------------------------------------------------------
// <copyright file="D2Env.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

using dotenv.net;

namespace D2.Shared.Utilities.Configuration;

/// <summary>
/// Convention-based environment variable loader for D2-WORX.
/// </summary>
/// <remarks>
/// <para>
/// Loads a <c>.env.local</c> or <c>.env</c> file and sets three environment variables per entry:
/// </para>
/// <list type="number">
///   <item><description>
///     <b>Original</b> — preserves the key as-is (e.g., <c>DB_USERNAME=postgres</c>).
///   </description></item>
///   <item><description>
///     <b>Infrastructure transform</b> — <c>Parameters__kebab-case</c>
///     (e.g., <c>Parameters__db-username</c>), which .NET maps to <c>Parameters:db-username</c>.
///   </description></item>
///   <item><description>
///     <b>Options transform</b> — splits on first <c>_</c> into <c>Section__Property</c>
///     (e.g., <c>GEOINFRAOPTIONS__IPINFOACCESSTOKEN</c>), which .NET maps case-insensitively
///     to <c>GeoInfraOptions:IpInfoAccessToken</c>.
///   </description></item>
/// </list>
/// <para>
/// Existing environment variables are never overwritten (<see cref="SetIfAbsent"/>),
/// so Aspire-injected or container-injected values always win.
/// </para>
/// </remarks>
public static class D2Env
{
    private const int _MAX_DEPTH = 12;

    private static readonly string[] sr_fileNames = [".env.local", ".env"];

    private static volatile bool sv_loaded;

    /// <summary>
    /// Loads environment variables from the nearest <c>.env.local</c> or <c>.env</c> file
    /// and sets the infrastructure and options transforms. Safe to call multiple times.
    /// </summary>
    public static void Load()
    {
        if (sv_loaded)
        {
            return;
        }

        sv_loaded = true;

        var envFile = FindEnvFile();
        if (envFile is null)
        {
            return;
        }

        // Read (don't auto-set) so we control the transformation.
        var vars = DotEnv.Read(new DotEnvOptions(envFilePaths: [envFile]));

        foreach (var (key, value) in vars)
        {
            // 1. Original name (for non-.NET consumers).
            SetIfAbsent(key, value);

            // 2. Infrastructure convention: Parameters:kebab-case.
            SetIfAbsent($"Parameters__{key.ToLowerInvariant().Replace('_', '-')}", value);

            // 3. Options convention: split on first _ → Section__Property.
            var sep = key.IndexOf('_');
            if (sep > 0 && sep < key.Length - 1)
            {
                SetIfAbsent($"{key[..sep]}__{key[(sep + 1)..]}", value);
            }
        }
    }

    /// <summary>
    /// Searches for the nearest env file by walking up from the binary directory.
    /// </summary>
    /// <returns>The full path to the env file, or <c>null</c> if not found.</returns>
    private static string? FindEnvFile()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < _MAX_DEPTH && dir is not null; i++, dir = dir.Parent)
        {
            foreach (var name in sr_fileNames)
            {
                var path = Path.Combine(dir.FullName, name);
                if (File.Exists(path))
                {
                    return path;
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Sets an environment variable only if it is not already set.
    /// </summary>
    /// <param name="key">The environment variable name.</param>
    /// <param name="value">The value to set.</param>
    private static void SetIfAbsent(string key, string value)
    {
        if (Environment.GetEnvironmentVariable(key) is null)
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
