using D2.Contracts.Result;

namespace D2.Contracts.Tests;

/// <summary>
/// Unit tests for the non-generic <see cref="D2Result"/> class.
/// </summary>
public class D2ResultTests
{
    [Fact]
    public void Ok_CreatesSuccessResult()
    {
        // Act
        var result = D2Result.Ok();

        // Assert
        Assert.True(result.Success);
        Assert.False(result.Failed);
        Assert.Empty(result.Messages);
        Assert.Empty(result.InputErrors);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.Null(result.ErrorCode);
        Assert.Null(result.TraceId);
    }

    [Fact]
    public void Ok_WithTraceId_IncludesTraceId()
    {
        // Arrange
        const string trace_id = "trace-123";

        // Act
        var result = D2Result.Ok(trace_id);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(trace_id, result.TraceId);
    }

    [Fact]
    public void Fail_WithMessages_CreatesFailureResult()
    {
        // Arrange
        List<string> messages = ["Error 1", "Error 2"];

        // Act
        var result = D2Result.Fail(messages);

        // Assert
        Assert.False(result.Success);
        Assert.True(result.Failed);
        Assert.Equal(messages, result.Messages);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Null(result.ErrorCode);
    }

    [Fact]
    public void Fail_WithCustomStatusCode_UsesProvidedStatusCode()
    {
        // Arrange
        const HttpStatusCode status_code = HttpStatusCode.Conflict;

        // Act
        var result = D2Result.Fail(statusCode: status_code);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(status_code, result.StatusCode);
    }

    [Fact]
    public void Fail_WithErrorCode_IncludesErrorCode()
    {
        // Arrange
        const string error_code = "CUSTOM_ERROR";

        // Act
        var result = D2Result.Fail(errorCode: error_code);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(error_code, result.ErrorCode);
    }

    [Fact]
    public void Fail_WithInputErrors_IncludesInputErrors()
    {
        // Arrange
        var inputErrors = new List<List<string>>
        {
            new() { "Field1", "Error message 1" },
            new() { "Field2", "Error message 2" }
        };

        // Act
        var result = D2Result.Fail(inputErrors: inputErrors);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(inputErrors, result.InputErrors);
    }

    [Fact]
    public void ValidationFailed_CreatesValidationFailureResult()
    {
        // Arrange
        var inputErrors = new List<List<string>>
        {
            new() { "Username", "Username is required" },
            new() { "Email", "Invalid email format" }
        };
        const string trace_id = "trace-456";

        // Act
        var result = D2Result.ValidationFailed(inputErrors: inputErrors, traceId: trace_id);

        // Assert
        Assert.False(result.Success);
        Assert.Contains("One or more validation errors occurred.", result.Messages);
        Assert.Equal(inputErrors, result.InputErrors);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Equal(ErrorCodes.VALIDATION_FAILED, result.ErrorCode);
        Assert.Equal(trace_id, result.TraceId);
    }

    [Fact]
    public void Constructor_WithSuccessTrue_DefaultsToOkStatusCode()
    {
        // Act
        var result = new D2Result(success: true);

        // Assert
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
    }

    [Fact]
    public void Constructor_WithSuccessFalse_DefaultsToBadRequestStatusCode()
    {
        // Act
        var result = new D2Result(success: false);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
    }

    [Theory]
    [InlineData("NOT_FOUND")]
    [InlineData("FORBIDDEN")]
    [InlineData("UNAUTHORIZED")]
    [InlineData("VALIDATION_FAILED")]
    [InlineData("CONFLICT")]
    public void CommonErrors_ContainsExpectedErrorCode(string errorCode)
    {
        // Assert
        var field = typeof(ErrorCodes).GetField(errorCode);
        Assert.NotNull(field);
        Assert.Equal(errorCode, field.GetValue(null));
    }
}
