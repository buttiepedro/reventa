"""Stand-ins for the two services the agent talks to.

They record calls instead of making them, so the tests are about the agent's own
decisions rather than about Reventa or Meta.
"""


class FakeReventa:
    def __init__(self, fail_with: tuple[int, str] | None = None) -> None:
        self.fail_with = fail_with
        self.calls: list[tuple] = []
        self.uploads: list[tuple] = []

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs.get("json"), kwargs.get("params")))
        if self.fail_with:
            return self.fail_with[0], {"detail": self.fail_with[1]}
        return 200, {}

    async def post(self, path, payload=None):
        self.calls.append(("POST", path, payload, None))
        if self.fail_with:
            return self.fail_with[0], {"detail": self.fail_with[1]}
        return 201, {"id": "veh-1", "share_token": "tok-1"}

    async def post_file(self, path, content, filename, content_type, params=None):
        self.uploads.append((path, filename, params))
        return 201, {"id": "img-1"}


class FakeMeta:
    def __init__(self, template_fails: bool = False) -> None:
        self.template_fails = template_fails
        self.texts: list[tuple[str, str]] = []
        self.templates: list[tuple[str, str, str, list[str]]] = []

    async def get_media(self, media_id):
        return b"\xff\xd8fake-jpeg", "image/jpeg"

    async def send_text(self, to, body):
        self.texts.append((to, body))

    async def send_template(self, to, name, language, params):
        self.templates.append((to, name, language, params))
        if self.template_fails:
            return False, "template not approved"
        return True, ""
