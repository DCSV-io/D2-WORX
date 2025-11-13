using D2.Contracts.Utilities.Enums;

namespace D2.Contracts.Utilities.Attributes;

/// <summary>
/// Attribute to indicate that certain data should be redacted from logging or other telemetry for
/// specified reasons.
/// </summary>
public class RedactDataAttribute : Attribute
{
    /// <summary>
    /// The reason for redacting the data.
    /// </summary>
    public RedactReason Reason { get; init; } = RedactReason.Unspecified;

    /// <summary>
    /// A custom reason for redaction, if applicable.
    /// </summary>
    public string? CustomReason { get; init; }
}
