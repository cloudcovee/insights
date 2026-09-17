import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_dash/collections/$collectionId")({
  component: RedirectToCatalog,
});

function RedirectToCatalog() {
  const { collectionId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/catalogs/$catalogId",
      params: { catalogId: collectionId },
      replace: true,
    });
  }, [collectionId, navigate]);

  return null;
}
