// -----------------------------------------------------------------------
// <copyright file="BHASW.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler;

using System.Diagnostics;

/// <summary>
/// Static class containing the activity source for the base handler.
/// </summary>
/// <remarks>
/// "BHASW" stands for "Base Handler Activity Source Wrapper".
/// </remarks>
internal static class BHASW
{
    /// <summary>
    /// The activity source for tracing handler operations.
    /// </summary>
    internal static readonly ActivitySource SR_ActivitySource
        = new("D2.Shared.Handler");
}
