import { describe, it, expect, vi, beforeEach } from "vitest";
import { canTransition, deploymentService } from "../deployment.service.js";
import { NotFoundError, InvalidTransitionError } from "../../../shared/errors.js";

const mockRepository = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  approve: vi.fn(),
  savePolicyViolations: vi.fn(),
  findByApplication: vi.fn(),
  findByEnvironment: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../deployment.repository.js", () => ({
  deploymentRepository: mockRepository,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canTransition", () => {
  it.each([
    ["pending", "building", true],
    ["pending", "cancelled", true],
    ["pending", "failed", true],
    ["pending", "deploying", false],
    ["pending", "healthy", false],
    ["pending", "rolled_back", false],
    ["building", "deploying", true],
    ["building", "failed", true],
    ["building", "cancelled", true],
    ["building", "pending", false],
    ["building", "healthy", false],
    ["deploying", "healthy", true],
    ["deploying", "failed", true],
    ["deploying", "cancelled", true],
    ["deploying", "building", false],
    ["deploying", "rolled_back", false],
    ["healthy", "rolled_back", true],
    ["healthy", "building", false],
    ["healthy", "deploying", false],
    ["failed", "building", false],
    ["failed", "healthy", false],
    ["cancelled", "building", false],
    ["cancelled", "healthy", false],
    ["rolled_back", "building", false],
    ["rolled_back", "pending", false],
  ])("from '%s' to '%s' returns %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe("deploymentService", () => {
  describe("list", () => {
    it("returns all deployments", async () => {
      const mock = [{ id: "1" }, { id: "2" }] as any[];
      mockRepository.findAll.mockResolvedValue(mock);

      const result = await deploymentService.list();

      expect(result).toEqual(mock);
      expect(mockRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe("getById", () => {
    it("returns deployment when found", async () => {
      mockRepository.findById.mockResolvedValue({ id: "abc" } as any);

      const result = await deploymentService.getById("abc");

      expect(result).toEqual({ id: "abc" });
    });

    it("throws NotFoundError when not found", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(deploymentService.getById("missing")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("creates a deployment", async () => {
      const input = {
        applicationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        environmentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        version: "1.0.0",
        commitSha: "abc123",
      };
      const mock = { id: "new-id", ...input };
      mockRepository.create.mockResolvedValue(mock as any);

      const result = await deploymentService.create(input);

      expect(result).toEqual(mock);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe("transitionStatus", () => {
    it("transitions to valid status", async () => {
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "pending" } as any);
      mockRepository.updateStatus.mockResolvedValue({ id: "d1", status: "building" } as any);

      const result = await deploymentService.transitionStatus("d1", "building");

      expect(result.status).toBe("building");
    });

    it("sets completedAt for terminal statuses", async () => {
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "deploying" } as any);
      mockRepository.updateStatus.mockResolvedValue({ id: "d1", status: "healthy" } as any);

      await deploymentService.transitionStatus("d1", "healthy");

      expect(mockRepository.updateStatus).toHaveBeenCalledWith("d1", "healthy", expect.any(Date));
    });

    it("throws NotFoundError for missing deployment", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(deploymentService.transitionStatus("missing", "building")).rejects.toThrow(NotFoundError);
    });

    it("throws InvalidTransitionError for invalid status transition", async () => {
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "pending" } as any);

      await expect(deploymentService.transitionStatus("d1", "healthy")).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("approve", () => {
    it("approves a pending deployment", async () => {
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "pending" } as any);
      mockRepository.approve.mockResolvedValue({ id: "d1", status: "deploying" } as any);

      const result = await deploymentService.approve("d1", "user-1");

      expect(result.status).toBe("deploying");
      expect(mockRepository.approve).toHaveBeenCalledWith("d1", "user-1");
    });

    it("throws InvalidTransitionError when approving non-pending deployment", async () => {
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "healthy" } as any);

      await expect(deploymentService.approve("d1", "user-1")).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("recordViolations", () => {
    it("records policy violations", async () => {
      const violations = [{ policyId: "p1", severity: "high", message: "test" }];
      mockRepository.findById.mockResolvedValue({ id: "d1", status: "deploying" } as any);
      mockRepository.savePolicyViolations.mockResolvedValue({ id: "d1" } as any);

      const result = await deploymentService.recordViolations("d1", violations);

      expect(result).toEqual({ id: "d1" });
      expect(mockRepository.savePolicyViolations).toHaveBeenCalledWith("d1", violations);
    });

    it("throws NotFoundError for missing deployment", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(deploymentService.recordViolations("missing", [])).rejects.toThrow(NotFoundError);
    });
  });
});
