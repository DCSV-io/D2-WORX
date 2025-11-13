using D2.Contracts.Result;

namespace D2.Contracts.Tests;

/// <summary>
/// Unit tests for the generic <see cref="D2Result{TData}"/> class.
/// </summary>
public class D2ResultGenericTests
{
    #region Factory Method Tests

    [Fact]
    public void Ok_WithData_CreatesSuccessResult()
    {
        // Arrange
        const string data = "test data";

        // Act
        var result = D2Result<string>.Ok(data);

        // Assert
        Assert.True(result.Success);
        Assert.False(result.Failed);
        Assert.Equal(data, result.Data);
        Assert.Empty(result.Messages);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.Null(result.ErrorCode);
    }

    [Fact]
    public void Ok_WithoutData_CreatesSuccessResultWithDefaultData()
    {
        // Act
        var result = D2Result<string>.Ok();

        // Assert
        Assert.True(result.Success);
        Assert.Null(result.Data);
    }

    [Fact]
    public void Ok_WithMessages_IncludesMessages()
    {
        // Arrange
        const int data = 42;
        List<string> messages = ["Success message"];

        // Act
        var result = D2Result<int>.Ok(data, messages);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(data, result.Data);
        Assert.Equal(messages, result.Messages);
    }

    [Fact]
    public void Ok_WithTraceId_IncludesTraceId()
    {
        // Arrange
        const bool data = true;
        const string trace_id = "trace-789";

        // Act
        var result = D2Result<bool>.Ok(data, traceId: trace_id);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(trace_id, result.TraceId);
    }

    [Fact]
    public void Created_CreatesSuccessResultWithCreatedStatus()
    {
        // Arrange
        var data = new { Id = 123, Name = "Test" };

        // Act
        var result = D2Result<object>.Created(data);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(data, result.Data);
        Assert.Equal(HttpStatusCode.Created, result.StatusCode);
    }

    [Fact]
    public void Fail_CreatesFailureResult()
    {
        // Arrange
        List<string> messages = ["Operation failed"];

        // Act
        var result = D2Result<string>.Fail(messages);

        // Assert
        Assert.False(result.Success);
        Assert.True(result.Failed);
        Assert.Null(result.Data);
        Assert.Equal(messages, result.Messages);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
    }

    [Fact]
    public void Fail_WithCustomStatusCode_UsesProvidedStatusCode()
    {
        // Arrange
        const HttpStatusCode status_code = HttpStatusCode.InternalServerError;

        // Act
        var result = D2Result<int>.Fail(statusCode: status_code);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(status_code, result.StatusCode);
    }

    [Fact]
    public void NotFound_CreatesNotFoundResult()
    {
        // Arrange
        List<string> messages = ["Resource not found"];

        // Act
        var result = D2Result<string>.NotFound(messages);

        // Assert
        Assert.False(result.Success);
        Assert.Null(result.Data);
        Assert.Equal(messages, result.Messages);
        Assert.Equal(HttpStatusCode.NotFound, result.StatusCode);
        Assert.Equal(ErrorCodes.NOT_FOUND, result.ErrorCode);
    }

    [Fact]
    public void NotFound_WithoutMessages_UsesDefaultMessage()
    {
        // Act
        var result = D2Result<int>.NotFound();

        // Assert
        Assert.False(result.Success);
        Assert.Contains("Resource not found.", result.Messages);
    }

    [Fact]
    public void Forbidden_CreatesForbiddenResult()
    {
        // Arrange
        List<string> messages = ["Access denied"];

        // Act
        var result = D2Result<string>.Forbidden(messages);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(HttpStatusCode.Forbidden, result.StatusCode);
        Assert.Equal(ErrorCodes.FORBIDDEN, result.ErrorCode);
    }

    [Fact]
    public void Forbidden_WithoutMessages_UsesDefaultMessage()
    {
        // Act
        var result = D2Result<string>.Forbidden();

        // Assert
        Assert.Contains("Insufficient permissions.", result.Messages);
    }

    [Fact]
    public void Unauthorized_CreatesUnauthorizedResult()
    {
        // Act
        var result = D2Result<string>.Unauthorized();

        // Assert
        Assert.False(result.Success);
        Assert.Equal(HttpStatusCode.Unauthorized, result.StatusCode);
        Assert.Equal(ErrorCodes.UNAUTHORIZED, result.ErrorCode);
        Assert.Contains("You must be signed in to perform this action.", result.Messages);
    }

    [Fact]
    public void ValidationFailed_CreatesValidationFailureResult()
    {
        // Arrange
        var inputErrors = new List<List<string>>
        {
            new() {"Email", "Invalid email format"},
            new() {"Password", "Password too weak"}
        };

        // Act
        var result = D2Result<object>.ValidationFailed(inputErrors: inputErrors);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Equal(ErrorCodes.VALIDATION_FAILED, result.ErrorCode);
        Assert.Equal(inputErrors, result.InputErrors);
        Assert.Contains("One or more validation errors occurred.", result.Messages);
    }

    [Fact]
    public void ValidationFailed_WithCustomMessages_UsesProvidedMessages()
    {
        // Arrange
        List<string> messages = ["Custom validation message"];
        var inputErrors = new List<List<string>>
        {
            new() {"Field", "Error"}
        };

        // Act
        var result = D2Result<string>.ValidationFailed(messages, inputErrors);

        // Assert
        Assert.Equal(messages, result.Messages);
    }

    [Fact]
    public void Conflict_CreatesConflictResult()
    {
        // Arrange
        List<string> messages = ["Resource already exists"];

        // Act
        var result = D2Result<string>.Conflict(messages);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(HttpStatusCode.Conflict, result.StatusCode);
        Assert.Equal(ErrorCodes.CONFLICT, result.ErrorCode);
    }

    [Fact]
    public void Conflict_WithoutMessages_UsesDefaultMessage()
    {
        // Act
        var result = D2Result<int>.Conflict();

        // Assert
        Assert.Contains("Conflict occurred while processing the request.", result.Messages);
    }

    [Fact]
    public void UnhandledException_CreatesInternalServerErrorResult()
    {
        // Arrange
        const string trace_id = "trace-error-123";

        // Act
        var result = D2Result<string>.UnhandledException(traceId: trace_id);

        // Assert
        Assert.False(result.Success);
        Assert.Equal(HttpStatusCode.InternalServerError, result.StatusCode);
        Assert.Equal("UNHANDLED_EXCEPTION", result.ErrorCode);
        Assert.Equal(trace_id, result.TraceId);
    }

    #endregion

    #region CheckSuccess/CheckFailure Tests

    [Fact]
    public void CheckSuccess_WhenSuccess_ReturnsTrueWithData()
    {
        // Arrange
        var data = "success data";
        var result = D2Result<string>.Ok(data);

        // Act
        var success = result.CheckSuccess(out var outData);

        // Assert
        Assert.True(success);
        Assert.Equal(data, outData);
    }

    [Fact]
    public void CheckSuccess_WhenFailure_ReturnsFalseWithNullData()
    {
        // Arrange
        var result = D2Result<string>.Fail(["Error"]);

        // Act
        var success = result.CheckSuccess(out var outData);

        // Assert
        Assert.False(success);
        Assert.Null(outData);
    }

    [Fact]
    public void CheckFailure_WhenFailure_ReturnsTrueWithNullData()
    {
        // Arrange
        var result = D2Result<int>.Fail(["Error"]);

        // Act
        var failed = result.CheckFailure(out var outData);

        // Assert
        Assert.True(failed);
        Assert.Equal(0, outData);
    }

    [Fact]
    public void CheckFailure_WhenSuccess_ReturnsFalseWithData()
    {
        // Arrange
        var data = 42;
        var result = D2Result<int>.Ok(data);

        // Act
        var failed = result.CheckFailure(out var outData);

        // Assert
        Assert.False(failed);
        Assert.Equal(data, outData);
    }

    #endregion

    #region BubbleFail Tests

    [Fact]
    public void BubbleFail_PreservesAllErrorDetails()
    {
        // Arrange
        List<string> originalMessages = ["Original error"];
        var originalInputErrors = new List<List<string>>
        {
            new() { "Field", "Validation error" }
        };
        const HttpStatusCode original_status_code = HttpStatusCode.BadRequest;
        const string original_error_code = "ORIGINAL_ERROR";
        const string original_trace_id = "trace-bubble-123";

        var original = new D2Result(
            false,
            originalMessages,
            originalInputErrors,
            original_status_code,
            original_error_code,
            original_trace_id);

        // Act
        var bubbled = D2Result<string>.BubbleFail(original);

        // Assert
        Assert.False(bubbled.Success);
        Assert.Null(bubbled.Data);
        Assert.Equal(originalMessages, bubbled.Messages);
        Assert.Equal(originalInputErrors, bubbled.InputErrors);
        Assert.Equal(original_status_code, bubbled.StatusCode);
        Assert.Equal(original_error_code, bubbled.ErrorCode);
        Assert.Equal(original_trace_id, bubbled.TraceId);
    }

    [Fact]
    public void BubbleFail_WithValidationFailure_PreservesValidationErrors()
    {
        // Arrange
        var inputErrors = new List<List<string>>
        {
            new() { "Email", "Required" },
            new() { "Password", "Too short" }
        };
        var original = D2Result.ValidationFailed(inputErrors: inputErrors, traceId: "trace-123");

        // Act
        var bubbled = D2Result<object>.BubbleFail(original);

        // Assert
        Assert.False(bubbled.Success);
        Assert.Equal(ErrorCodes.VALIDATION_FAILED, bubbled.ErrorCode);
        Assert.Equal(inputErrors, bubbled.InputErrors);
    }

    #endregion

    #region Complex Type Tests

    [Fact]
    public void Ok_WithComplexType_PreservesComplexData()
    {
        // Arrange
        var data = new TestDto
        {
            Id = 123,
            Name = "Test",
            Values = [1, 2, 3]
        };

        // Act
        var result = D2Result<TestDto>.Ok(data);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(data.Id, result.Data?.Id);
        Assert.Equal(data.Name, result.Data?.Name);
        Assert.Equal(data.Values, result.Data?.Values);
    }

    [Fact]
    public void CheckSuccess_WithComplexType_ReturnsComplexData()
    {
        // Arrange
        var data = new TestDto { Id = 456, Name = "Complex" };
        var result = D2Result<TestDto>.Ok(data);

        // Act
        var success = result.CheckSuccess(out var outData);

        // Assert
        Assert.True(success);
        Assert.NotNull(outData);
        Assert.Equal(data.Id, outData.Id);
        Assert.Equal(data.Name, outData.Name);
    }

    #endregion

    #region Helper Classes

    private class TestDto
    {
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public List<int> Values { get; init; } = [];
    }

    #endregion
}
